import { describe, expect, it } from "bun:test";
import { OrderService } from "../src/order-service";
import { InMemoryOrderRepository } from "../src/order-repository";
import type { Notifier } from "../src/notifier";

class FakeNotifier implements Notifier {
  readonly sent: string[] = [];
  notify(customer: string, message: string): void {
    this.sent.push(`${customer}: ${message}`);
  }
}

function service() {
  let n = 0;
  const notifier = new FakeNotifier();
  const svc = new OrderService(new InMemoryOrderRepository(), notifier, () => `o${++n}`);
  return { svc, notifier };
}

describe("placing an order", () => {
  it("stores the order as placed", () => {
    const { svc } = service();
    const order = svc.place("Rye & Co", [{ product: "sourdough", quantity: 12 }]);
    expect(order.status).toBe("placed");
  });

  it("refuses an order with no lines", () => {
    const { svc } = service();
    expect(() => svc.place("Rye & Co", [])).toThrow("at least one line");
  });
});

describe("confirming an order", () => {
  it("moves a placed order to confirmed and tells the customer", () => {
    const { svc, notifier } = service();
    const order = svc.place("Rye & Co", [{ product: "sourdough", quantity: 12 }]);
    const confirmed = svc.confirm(order.id);
    expect(confirmed.status).toBe("confirmed");
    expect(notifier.sent).toEqual(["Rye & Co: order o1 confirmed"]);
  });

  it("refuses to confirm twice", () => {
    const { svc } = service();
    const order = svc.place("Rye & Co", [{ product: "sourdough", quantity: 12 }]);
    svc.confirm(order.id);
    expect(() => svc.confirm(order.id)).toThrow("not placed");
  });
});
