import type { Table, UpdateSpec } from 'dexie'

type EntityWithId = {
  id?: number
}

export class CrudService<T extends EntityWithId> {
  private readonly table: Table<T, number>

  constructor(table: Table<T, number>) {
    this.table = table
  }

  async create(payload: Omit<T, 'id'>) {
    return this.table.add(payload as T)
  }

  async getById(id: number) {
    return this.table.get(id)
  }

  async listAll() {
    return this.table.toArray()
  }

  async update(id: number, payload: Partial<Omit<T, 'id'>>) {
    return this.table.update(id, payload as unknown as UpdateSpec<T>)
  }

  async remove(id: number) {
    return this.table.delete(id)
  }

  async clearAll() {
    return this.table.clear()
  }
}
