export function LogTiming() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const original = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      const start = performance.now();
      try {
        return await original.apply(this, args);
      } finally {
        const ms = performance.now() - start;
        console.log(
          `[perm-timing] ${target.constructor.name}.${propertyKey} ${ms.toFixed(2)}ms`,
        );
      }
    };
    return descriptor;
  };
}
