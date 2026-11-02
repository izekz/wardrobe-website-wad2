// Protect prepaid Style Feed promotion time while a linked product is unavailable.
// A paused boost keeps the unused portion of its original 7-day window. When the
// product is available again, its expiry moves forward by exactly the pause.
function boostIsLive(video, at = new Date()) {
  return Boolean(video.boostedUntil && !video.boostPausedAt && new Date(video.boostedUntil) > at);
}

function remainingBoostMs(video, at = new Date()) {
  if (!video.boostedUntil) return 0;
  const reference = video.boostPausedAt ? new Date(video.boostPausedAt) : at;
  return Math.max(0, new Date(video.boostedUntil).getTime() - reference.getTime());
}

async function syncProductBoosts(Video, productId, available, { at = new Date(), session = null } = {}) {
  if (!Video) return;
  const id = String(productId);
  const opts = session ? { session } : {};
  if (!available) {
    // Atomic compare-and-set avoids repeatedly restarting the pause clock.
    await Video.updateMany({ productId: id, boostPausedAt: null, boostedUntil: { $gt: at } },
      { $set: { boostPausedAt: at } }, opts);
    return;
  }
  let query = Video.find({ productId: id, boostPausedAt: { $ne: null } });
  if (session) query = query.session(session);
  const paused = await query;
  for (const video of paused) {
    const remaining = remainingBoostMs(video, at);
    // Update only if this is still the pause we inspected. Concurrent reloads
    // cannot give the business extra days by resuming twice.
    await Video.updateOne({ _id: video._id, boostPausedAt: video.boostPausedAt },
      { $set: { boostedUntil: new Date(at.getTime() + remaining) }, $unset: { boostPausedAt: '' } }, opts);
  }
}

module.exports = { boostIsLive, remainingBoostMs, syncProductBoosts };
