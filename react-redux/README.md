# React-Redux 源码分析

> 简化代码，添加类型注释

1. 使用redux::createStore生成store，传入Provider.value。

2. Provider把store放入state中，并作为context向下传递。同时传下去的还有subscription。

3. connect函数创建一个新的函数组件Connect，内部让context中的store subscribe一个checkUpdate函数，checkUpdate负责新旧state对比，如不同则setState更新(forceUpdate)。然后将Target组件及其父类上的属性拷贝到Connect组件上，返回Connect组件