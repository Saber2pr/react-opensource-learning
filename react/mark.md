### React 中的异常处理

1. 错误捕获[ReactFiberWorkLoop/throwException](./react-reconciler/ReactFiberWorkLoop.js#L900)

throwException 向上找 Suspense，没找到就视为错误，找到做 fallback 处理。视为错误会检查错误链路上是否有 class 组件实现了 componentDidCatch 方法，并将 error 传入。

2. class 组件错误处理钩子[componentDidCatch](./react-reconciler/ReactFiberThrow.js#L126)

3. 抛出 throwException 接收的错误[logError](./react-reconciler/ReactFiberCommitWork.js#L129)

4. 打印 fiber 向上的链路[getStackByFiberInDevAndProd](./react-reconciler/ReactCurrentFiber.js#49)
