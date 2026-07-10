export function groupBy<T>(
  array: T[],
  keySelector: (item: T) => string | number | symbol,
) {
  const result: Record<string, T[]> = {};

  for (const item of array) {
    const propertyValue = keySelector(item);

    if (propertyValue !== undefined) {
      const stringifiedValue = String(propertyValue);

      result[stringifiedValue]?.push(item) ??
        (result[stringifiedValue] = [item]);
    }
  }

  return result;
}

export function orderByFairness<T>(
  collection: T[],
  keySelector: (item: T) => string | number | symbol,
  compareFn?: (a: T, b: T) => number,
) {
  const grouped = groupBy(collection, keySelector);
  const returnArray = Array<T>();

  while (returnArray.length < collection.length) {
    const round = Array<T>();

    for (const key in grouped) {
      const group = grouped[key];
      const item = group?.shift();

      if (item) {
        round.push(item);
      }
    }

    returnArray.push(...round.sort(compareFn));
  }

  return returnArray;
}
