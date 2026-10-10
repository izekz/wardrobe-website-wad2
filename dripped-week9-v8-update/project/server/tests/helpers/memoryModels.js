// Test-only, validated in-memory models. Never used by the running application.
const { defaultModels } = require('../../routes/community');
function matches(doc, filter = {}) {
  return Object.entries(filter).every(([key, value]) => {
    if (key === '$or') return value.some(part => matches(doc, part));
    if (key === '$and') return value.every(part => matches(doc, part));
    const actual = key.split('.').reduce((target, field) => target?.[field], doc);
    if (value === null) return actual == null;
    if (value && typeof value === 'object' && !value._bsontype && !(value instanceof Date)) {
      return Object.entries(value).every(([operator, operand]) => {
        if (operator === '$in') return operand.some(item => String(item) === String(actual));
        if (operator === '$regex') return new RegExp(operand, value.$options).test(actual);
        if (operator === '$options') return true;
        if (operator === '$lte') return actual <= operand;
        if (operator === '$gte') return actual >= operand;
        if (operator === '$gt') return actual > operand;
        if (operator === '$lt') return actual < operand;
        if (operator === '$ne') return String(actual) !== String(operand);
        if (operator === '$exists') return (actual !== undefined) === operand;
        return false;
      });
    }
    return String(actual) === String(value);
  });
}
function memoryModel(Model) {
  const rows = [];
  function duplicate(doc) {
    return rows.some(row => String(row._id) !== String(doc._id) && (
      (doc.clientRequestId && row.clientRequestId === doc.clientRequestId && (row.ownerId || row.consumerId) === (doc.ownerId || doc.consumerId)) ||
      (Model.modelName === 'RequestPurchase' && String(row.requestId) === String(doc.requestId)) ||
      (Model.modelName === 'User' && row.email === doc.email) ||
      (Model.modelName === 'Business' && row.ownerId === doc.ownerId)
    ));
  }
  function attach(doc) {
    doc.save = async () => {
      await doc.validate();
      if (duplicate(doc)) throw Object.assign(new Error('Duplicate test record'), { code: 11000 });
      doc.createdAt ||= new Date(); doc.updatedAt = new Date();
      const index = rows.findIndex(row => String(row._id) === String(doc._id));
      if (index < 0) rows.push(doc); else rows[index] = doc;
      return doc;
    };
    return doc;
  }
  function query(getRows, single = false) {
    let order = {}, offset = 0, limit = Infinity;
    return {
      sort(value) { order = value; return this; },
      skip(value) { offset = value; return this; },
      limit(value) { limit = value; return this; },
      select() { return this; }, session() { return this; },
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
  }
  function FakeModel(data) { return attach(new Model(data)); }
  Object.assign(FakeModel, {
    rows,
    snapshot() { return rows.map(row => row.toObject()); },
    restore(data) { rows.splice(0, rows.length, ...data.map(row => attach(new Model(row)))); },
    find(filter) { return query(() => rows.filter(row => matches(row, filter))); },
    findOne(filter) { return query(() => rows.filter(row => matches(row, filter)), true); },
    findById(id) { return query(() => rows.filter(row => String(row._id) === String(id)), true); },
    async countDocuments(filter) { return rows.filter(row => matches(row, filter)).length; },
    async findOneAndUpdate(filter, update) {
      const row = rows.find(row => matches(row, filter));
      if (!row) return null;
      const doc = attach(new Model(row.toObject()));
      for (const [key, value] of Object.entries(update.$set || {})) doc.set(key, value);
      for (const [key, value] of Object.entries(update.$inc || {})) doc.set(key, (doc.get(key) || 0) + value);
      for (const key of Object.keys(update.$unset || {})) doc.set(key, undefined);
      await doc.save(); return doc;
    },
    async updateMany(filter, update) {
      const ids = rows.filter(row => matches(row, filter)).map(row => row._id);
      for (const id of ids) await this.findOneAndUpdate({ _id: id }, update);
      return { modifiedCount: ids.length };
    },
    async updateOne(filter, update) { return { modifiedCount: (await this.findOneAndUpdate(filter, update)) ? 1 : 0 }; },
    async findOneAndDelete(filter) {
      const index = rows.findIndex(row => matches(row, filter));
      if (index < 0) return null;
      return rows.splice(index, 1)[0];
    },
    async deleteOne(filter) { return { deletedCount: (await this.findOneAndDelete(filter)) ? 1 : 0 }; },
    async create(data) {
      if (Array.isArray(data)) { const records = []; for (const item of data) records.push(await this.create(item)); return records; }
      return new FakeModel({ ...data, createdAt: new Date(), updatedAt: new Date() }).save();
    },
  });
  return FakeModel;
}
function memoryModels() {
  return Object.fromEntries(Object.entries(defaultModels).map(([name, Model]) => [name, memoryModel(Model)]));
}
// Serialises transaction fixtures and rolls back all model writes on failure.
// Tests application behaviour; real MongoDB transaction tests are a separate opt-in suite.
function memoryTransactions(models) {
  let tail = Promise.resolve();
  return work => {
    const task = tail.then(async () => {
      const snapshots = Object.values(models).filter(model => model.snapshot).map(model => [model, model.snapshot()]);
      try { return await work(null); }
      catch (error) { for (const [model, snapshot] of snapshots) model.restore(snapshot); throw error; }
    });
    tail = task.catch(() => {});
    return task;
  };
}
module.exports = { memoryModels, memoryModel, memoryTransactions };
