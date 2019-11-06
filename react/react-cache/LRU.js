/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import * as Scheduler from 'scheduler'

const {
  unstable_scheduleCallback: scheduleCallback,
  unstable_IdlePriority: IdlePriority,
} = Scheduler;

type Entry<T> = {|
  value: T,
  onDelete: () => mixed,
  previous: Entry<T>,
  next: Entry<T>,
|};

export function createLRU<T>(limit: number) {
  let LIMIT = limit;

  let first: Entry<T> | null = null;
  let size: number = 0;

  let cleanUpIsScheduled: boolean = false;

  function scheduleCleanUp() {
    if (cleanUpIsScheduled === false && size > LIMIT) {
      cleanUpIsScheduled = true;
      scheduleCallback(IdlePriority, cleanUp);
    }
  }

  function cleanUp() {
    cleanUpIsScheduled = false;
    deleteLeastRecentlyUsedEntries(LIMIT);
  }

  function deleteLeastRecentlyUsedEntries(targetSize: number) {
    //从列表末尾开始删除缓存中的条目。
    if (first !== null) {
      const resolvedFirst: Entry<T> = (first: any);
      let last = resolvedFirst.previous;
      while (size > targetSize && last !== null) {
        const onDelete = last.onDelete;
        const previous = last.previous;
        last.onDelete = null;

        //从列表中删除
        last.previous = last.next = null
        if (last === first) {
          //到达列表的头部。
          first = last = null;
        } else {
          first.previous = previous
          previous.next = first
          last = previous;
        }

        size -= 1;
        onDelete();
      }
    }
  }

  function add(value: T, onDelete: () => mixed): Entry<T> {
    const entry = {
      value,
      onDelete,
      next: null,
      previous: null,
    };
    if (first === null) {
      entry.previous = entry.next = entry;
      first = entry;
    } else {
      //追加头
      const last = first.previous;
      last.next = entry;
      entry.previous = last;

      first.previous = entry;
      entry.next = first;

      first = entry;
    }
    size += 1;
    return entry;
  }

  function update(entry: Entry<T>, newValue: T): void {
    entry.value = newValue;
  }

  function access(entry: Entry<T>): T {
    const next = entry.next;
    if (next !== null) {
      //条目已缓存 
      const resolvedFirst: Entry<T> = first
      if (first !== entry) {
        //从当前位置删除
        const previous = entry.previous
        previous.next = next
        next.previous = previous

        //追加头
        const last = resolvedFirst.previous
        last.next = entry
        entry.previous = last

        resolvedFirst.previous = entry
        entry.next = resolvedFirst

        first = entry
      }
    } else {
      //无法访问已删除的条目
      //TODO：错误？警告？
    }
    scheduleCleanUp();
    return entry.value;
  }

  function setLimit(newLimit: number) {
    LIMIT = newLimit;
    scheduleCleanUp();
  }

  return {
    add,
    update,
    access,
    setLimit,
  };
}
