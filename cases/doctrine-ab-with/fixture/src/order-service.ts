import type { Line, Order } from "./order";
import type { OrderRepository } from "./order-repository";
import type { Notifier } from "./notifier";

export class OrderService {
  constructor(
    private readonly repo: OrderRepository,
    private readonly notifier: Notifier,
    private readonly nextId: () => string,
  ) {}

  place(customer: string, lines: readonly Line[]): Order {
    if (lines.length === 0) {
      throw new Error("an order needs at least one line");
    }
    const order: Order = { id: this.nextId(), customer, lines, status: "placed" };
    this.repo.save(order);
    return order;
  }

  confirm(id: string): Order {
    const txn = this.mustGet(id);
    if (txn.status !== "placed") {
      throw new Error(`order ${id} is ${txn.status}, not placed`);
    }
    const confirmed: Order = { ...txn, status: "confirmed" };
    this.repo.save(confirmed);
    this.notifier.notify(txn.customer, `order ${id} confirmed`);
    return confirmed;
  }

  dispatch(id: string): Order {
    const txn = this.mustGet(id);
    if (txn.status === "dispatched") {
      return txn;
    }
    const dispatched: Order = { ...txn, status: "dispatched" };
    this.repo.save(dispatched);
    this.notifier.notify(txn.customer, `order ${id} is on the van`);
    return dispatched;
  }

  private mustGet(id: string): Order {
    const txn = this.repo.get(id);
    if (txn === undefined) {
      throw new Error(`no order ${id}`);
    }
    return txn;
  }
}
