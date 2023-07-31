module.exports = ({
  knex = {},
  name = 'default_name',
  tableName = 'default_tablename',
  selectableProps = [],
  timeout = 1000,
}) => {
  const create = (props) => {
    delete props.id; // not allowed to set `id`

    return knex.insert(props).returning(selectableProps).into(tableName).timeout(timeout);
  };

  const all = () => {
    return knex.select(selectableProps).from(tableName).timeout(timeout);
  };

  const filtered = (filters) => {
    return knex.select(selectableProps).from(tableName).where(filters).timeout(timeout);
  };

  // Same as `find` but only returns the first match
  const filteredFirst = (filters) => {
    return filtered(filters).then((results) => {
      if (!Array.isArray(results)) {
        return results;
      }
      return results[0];
    });
  };

  const get = (id) => {
    return knex.select(selectableProps).from(tableName).where({ id }).timeout(timeout);
  };

  const update = (id, props) => {
    delete props.id; // not allowed to set `id`

    return knex.update(props).from(tableName).where({ id }).returning(selectableProps).timeout(timeout);
  };

  const remove = (id) => {
    knex.del().from(tableName).where({ id }).timeout(timeout);
  };

  return {
    name,
    tableName,
    selectableProps,
    timeout,
    create,
    all,
    filtered,
    filteredFirst,
    get,
    update,
    remove,
  };
};
