import type { Order } from "./order";

export interface OrderRepository {
  get(id: string): Order | undefined;
  save(order: Order): void;
}

export class InMemoryOrderRepository implements OrderRepository {
  private readonly orders = new Map<string, Order>();

  get(id: string): Order | undefined {
    return this.orders.get(id);
  }

  save(order: Order): void {
    this.orders.set(order.id, order);
  }
}
