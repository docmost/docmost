// Keeps a class out of decorator metadata, which would read it too early in an import cycle.
export type WrapperType<T> = T;
