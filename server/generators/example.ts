/**
 * Example generator function.
 * @returns An iterator that yields numbers from 1 to 5.
 */
export function* exampleGenerator() {
  for (let i = 1; i <= 5; i++) {
    yield i;
  }
}
