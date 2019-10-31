export default class Task<T> {
  resolve: (value: T) => void;
  reject: (error?) => void;
  promise = new Promise((resolve, reject) => {
    this.resolve = resolve;
    this.reject = reject;
  });
}
