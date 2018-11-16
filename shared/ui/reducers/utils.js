export function toMapBy(key, entities) {
	return entities.reduce(function(map, entity) {
		map[entity[key]] = entity;
		return map;
	}, Object.create(null));
}
