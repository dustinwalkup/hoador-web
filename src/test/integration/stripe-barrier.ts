/**
 * A gate a mocked Stripe call can wait on, so a test decides when (and in
 * which order) two concurrent operations get past the network call:
 *
 *   const barrier = createBarrier();
 *   vi.mocked(chargeRentalPayment).mockImplementation(async () => {
 *     await barrier.wait();
 *     return { success: true, paymentIntentId: "pi_1" };
 *   });
 *   const race = raceTwo(() => approve(), () => cancel());
 *   // … both are now parked inside the charge …
 *   barrier.release();
 *   const { results } = await race;
 */
export function createBarrier() {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  return { wait: () => gate, release };
}
