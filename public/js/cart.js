document.getElementById('checkout-button').addEventListener('click', async () => {
    const stripe = Stripe('YOUR_PUBLIC_STRIPE_KEY');
    const sessionId = '<%= sessionId %>'; // Ensure this is populated correctly from the backend.

    if (!sessionId || sessionId.includes('<%')) {
        console.error('Session ID is not valid:', sessionId);
        return;
    }

    try {
        const result = await stripe.redirectToCheckout({ sessionId });
        if (result.error) {
            console.error(result.error.message);
        }
    } catch (err) {
        console.error('Error redirecting to Stripe checkout:', err);
    }
});
