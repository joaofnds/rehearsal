export interface Notifier {
  notify(customer: string, message: string): void;
}

export class ConsoleNotifier implements Notifier {
  notify(customer: string, message: string): void {
    console.log(`[notify ${customer}] ${message}`);
  }
}
