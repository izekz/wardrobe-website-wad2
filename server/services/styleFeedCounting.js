// A viewer can contribute up to 10 genuine video views per video and up to
// 10 sponsored impressions per boost campaign. Views and reach are different:
// returning viewers can increase views while unique reach increases only once.
const MAX_REPEATS = 10;
async function countUpToLimit(Video, videoId, userId, metric, counter) {
  const uid = String(userId);
  // Existing viewer: update the same array element only if below the cap.
  const existing = await Video.updateOne(
    { _id: videoId, [counter]: { $elemMatch: { userId: uid, count: { $lt: MAX_REPEATS } } } },
    { $inc: { [`${counter}.$.count`]: 1, [metric]: 1 } });
  if (existing.modifiedCount) return true;
  // New viewer: add a counter, but only when this account isn't already listed.
  const first = await Video.updateOne(
    { _id: videoId, [`${counter}.userId`]: { $ne: uid } },
    { $push: { [counter]: { userId: uid, count: 1 } }, $inc: { [metric]: 1 } });
  return Boolean(first.modifiedCount);
}
module.exports = { MAX_REPEATS, countUpToLimit };
