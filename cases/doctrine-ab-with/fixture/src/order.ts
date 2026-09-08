export type OrderStatus = "placed" | "confirmed" | "dispatched";

export interface Line {
  readonly product: string;
  readonly quantity: number;
}

export interface Order {
  readonly id: string;
  readonly customer: string;
  readonly lines: readonly Line[];
  readonly status: OrderStatus;
}
