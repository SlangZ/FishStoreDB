// checkout.js

const stripe = Stripe('YOUR_PUBLIC_STRIPE_KEY'); // Replace with your Stripe public key
const elements = stripe.elements();
const cardElement = elements.create('card');
cardElement.mount('#card-element');

// Payment method radio buttons change event
document.querySelectorAll('input[name="paymentMethod"]').forEach((radio) => {
  radio.addEventListener('change', (e) => {
    const selectedPaymentMethod = e.target.value;

    if (selectedPaymentMethod === 'creditCard') {
      document.getElementById('stripe-payment').classList.remove('d-block');
      document.getElementById('paypal-payment').classList.add('d-none');
    } else if (selectedPaymentMethod === 'paypal') {
      document.getElementById('stripe-payment').classList.add('d-block');
      document.getElementById('paypal-payment').classList.remove('d-none');
    }
  });
});

document.getElementById('pay-button').addEventListener('click', async () => {
  const selectedPaymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;

  if (selectedPaymentMethod === 'creditCard') {
    const { error, paymentIntent } = await stripe.confirmCardPayment('<%= clientSecret %>', {
      payment_method: {
        card: cardElement,
      },
    });

    if (error) {
      alert('Payment failed: ' + error.message);
    } else {
      alert('Payment successful!');
      window.location.href = '/order-success'; // Adjust redirect path as needed
    }
  } else if (selectedPaymentMethod === 'paypal') {
    // Implement PayPal payment logic here
    alert('PayPal payment method selected');
    window.location.href = '/paypal-success'; // Adjust redirect path as needed
  }
});
