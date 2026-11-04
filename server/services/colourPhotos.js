// Person 4: one photo per colour. A one-colour product only uses its main photo.
// With several colours, every colour needs a photo and the first colour's photo
// is also the main photo, so its row keeps no copy of the image data.
const { badRequest } = require('../communityValidation');

const MAX_COLOURS_WITH_PHOTOS = 6;
const MAX_COLOUR_PHOTO_BYTES = 1024 * 1024;

function imageFor(row, mainPhoto) {
  return row?.data?.length ? row : mainPhoto?.data?.length ? mainPhoto : null;
}

// `uploads` is { Black: { data, contentType } }. `stored` is the product being edited.
function resolveColourPhotos({ colours, photo, uploads = {} }, stored = null) {
  const saved = new Map((stored?.colourPhotos || []).map(row => [row.colour, imageFor(row, stored.photo)]));
  const first = colours[0];
  if (colours.length === 1) {
    const chosen = uploads[first] || photo || saved.get(first);
    return { photo: chosen ? { data: chosen.data, contentType: chosen.contentType } : undefined, colourPhotos: [] };
  }
  if (colours.length > MAX_COLOURS_WITH_PHOTOS) throw badRequest(`Choose up to ${MAX_COLOURS_WITH_PHOTOS} colours.`);
  // An older one-photo listing keeps its photo as the first colour's photo.
  const firstFallback = photo || (!saved.size ? stored?.photo : null);
  const images = colours.map((colour, index) => {
    const image = uploads[colour] || (index === 0 && firstFallback) || saved.get(colour);
    if (!image?.data?.length) throw badRequest(`Add a photo for ${colour}.`);
    return image;
  });
  return {
    photo: { data: images[0].data, contentType: images[0].contentType },
    colourPhotos: colours.map((colour, index) => ({
      colour, contentType: images[index].contentType, ...(index === 0 ? {} : { data: images[index].data })
    }))
  };
}

module.exports = { MAX_COLOURS_WITH_PHOTOS, MAX_COLOUR_PHOTO_BYTES, imageFor, resolveColourPhotos };
