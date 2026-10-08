// Tests only: never used by server.js. Does not connect to any database.
const { defaultModels } = require('../../routes/community');
function matches(doc, filter) {
  return Object.entries(filter).every(([key, value]) => {
    if (key === '$or') return value.some(part => matches(doc, part));
    if (value && typeof value === 'object' && !value._bsontype) {
      if ('$regex' in value) return new RegExp(value.$regex, value.$options).test(doc[key]);
      if ('$lte' in value) return doc[key] <= value.$lte;
      if ('$gte' in value) return doc[key] >= value.$gte;
    }
    return String(doc[key]) === String(value);
  });
}
function memoryModel(Model) {
  const rows = [];
  function query(getRows, single = false) {
    let order = {}, offset = 0, limit = Infinity;
    const result = {
      sort(value) { order = value; return this; },
      skip(value) { offset = value; return this; },
      limit(value) { limit = value; return this; },
      select() { return this; },
      then(resolve, reject) {
        return Promise.resolve().then(() => {
          const values = getRows().slice().sort((a, b) => {
            for (const [key, direction] of Object.entries(order)) {
              if (String(a[key]) === String(b[key])) continue;
              return (a[key] > b[key] ? 1 : -1) * direction;
            }
            return 0;
          }).slice(offset, offset + limit);
          return single ? values[0] || null : values;
        }).then(resolve, reject);
      },
    };
    return result;
  }
  return {
    rows,
    find(filter) { return query(() => rows.filter(row => matches(row, filter))); },
    findOne(filter) { return query(() => rows.filter(row => matches(row, filter)), true); },
    findById(id) { return query(() => rows.filter(row => String(row._id) === String(id)), true); },
    async countDocuments(filter) { return rows.filter(row => matches(row, filter)).length; },
    async create(data) {
      const doc = new Model({ ...data, createdAt: new Date(), updatedAt: new Date() });
      await doc.validate();
      if (doc.clientRequestId && rows.some(row => row.clientRequestId === doc.clientRequestId &&
        (row.ownerId || row.consumerId) === (doc.ownerId || doc.consumerId))) {
        const error = new Error('Duplicate test request'); error.code = 11000; throw error;
      }
      rows.push(doc);
      return doc;
    },
  };
}
function memoryModels() {
  return Object.fromEntries(Object.entries(defaultModels).map(([name, Model]) => [name, memoryModel(Model)]));
}
module.exports = { memoryModels };
