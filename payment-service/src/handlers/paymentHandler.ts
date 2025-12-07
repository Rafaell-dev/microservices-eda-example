import { v4 as uuidv4 } from "uuid";
import { publishEvent } from "../../../shared/eventPublisher";
import {
  BaseEvent,
  OrderCreatedPayload,
  PaymentProcessedPayload,
  PaymentFailedPayload,
} from "../../../shared/types";

// Simulated payment methods
const PAYMENT_METHODS = ["credit_card", "debit_card", "pix", "boleto"];

// Simulated failure rate (20% chance of failure)
const FAILURE_RATE = 0.2;

export async function handlePaymentEvent(event: BaseEvent): Promise<void> {
  if (event.eventType !== "OrderCreated") {
    console.log(`[PaymentHandler] Ignoring event type: ${event.eventType}`);
    return;
  }

  const payload = event.payload as OrderCreatedPayload;
  console.log(
    `[PaymentHandler] Processing payment for order: ${payload.orderId}`
  );

  // Simulate payment processing delay
  await simulateProcessingDelay();

  // Simulate random payment success/failure
  const isSuccess = Math.random() > FAILURE_RATE;

  if (isSuccess) {
    const paymentPayload: PaymentProcessedPayload = {
      orderId: payload.orderId,
      paymentId: uuidv4(),
      amount: payload.total,
      method:
        PAYMENT_METHODS[Math.floor(Math.random() * PAYMENT_METHODS.length)],
    };

    await publishEvent("PaymentProcessed", paymentPayload);
    console.log(
      `[PaymentHandler] Payment processed successfully for order: ${payload.orderId}`
    );
  } else {
    const failureReasons = [
      "Insufficient funds",
      "Card declined",
      "Transaction timeout",
      "Invalid payment details",
    ];

    const failedPayload: PaymentFailedPayload = {
      orderId: payload.orderId,
      reason: failureReasons[Math.floor(Math.random() * failureReasons.length)],
      amount: payload.total,
    };

    await publishEvent("PaymentFailed", failedPayload);
    console.log(
      `[PaymentHandler] Payment failed for order: ${payload.orderId} - ${failedPayload.reason}`
    );
  }
}

async function simulateProcessingDelay(): Promise<void> {
  const delay = Math.floor(Math.random() * 2000) + 500; // 500-2500ms
  return new Promise((resolve) => setTimeout(resolve, delay));
}
