const User = require('../models/User');

const PARTIAL_STRING_FILTER = (field) => ({
  [field]: { $exists: true, $type: 'string' }
});

const isSameSpec = (left = {}, right = {}) => JSON.stringify(left) === JSON.stringify(right);

const ensurePartialUniqueIndex = async (collection, indexName, key, field) => {
  const indexes = await collection.indexes();
  const existing = indexes.find((index) => index.name === indexName);
  const partialFilterExpression = PARTIAL_STRING_FILTER(field);

  // Older data may contain empty strings. Clear them first so the new
  // partial unique index only applies to meaningful values.
  await collection.updateMany(
    { [field]: '' },
    { $unset: { [field]: '' } }
  );

  const alreadyMatched = existing
    && existing.unique === true
    && isSameSpec(existing.key, key)
    && isSameSpec(existing.partialFilterExpression, partialFilterExpression);

  if (alreadyMatched) {
    return;
  }

  if (existing) {
    await collection.dropIndex(indexName);
  }

  await collection.createIndex(key, {
    name: indexName,
    unique: true,
    partialFilterExpression
  });
};

const migrateUserIndexes = async () => {
  const collection = User.collection;

  await ensurePartialUniqueIndex(collection, 'phone_1', { phone: 1 }, 'phone');
  await ensurePartialUniqueIndex(collection, 'wechatOpenId_1', { wechatOpenId: 1 }, 'wechatOpenId');
};

module.exports = {
  migrateUserIndexes
};
