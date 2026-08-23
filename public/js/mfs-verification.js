/**
 * Mobile Financial Service (bKash / Nagad) Verification Flow
 * Handles step-by-step account number verification, OTP input, PIN submission, and SSLCommerz payment finalization.
 */
document.addEventListener('DOMContentLoaded', () => {
    const paymentMethod = window.MFS_PAYMENT_METHOD || 'bkash';
    const themeColor = paymentMethod === 'bkash' ? '#e2136e' : '#f7921e';
    const encodedData = window.MFS_ENCODED_DATA || '';

    const mfsStep1 = document.getElementById('mfsStep1');
    const mfsStep2 = document.getElementById('mfsStep2');
    const mfsStep3 = document.getElementById('mfsStep3');
    const mfsProcessingState = document.getElementById('mfsProcessingState');
    const mfsProgressLine = document.getElementById('mfsProgressLine');
    const circle1 = document.getElementById('circle1');
    const circle2 = document.getElementById('circle2');
    const circle3 = document.getElementById('circle3');

    const mfsAccountNumber = document.getElementById('mfsAccountNumber');
    const mfsOtpCode = document.getElementById('mfsOtpCode');
    const mfsPinCode = document.getElementById('mfsPinCode');

    const mfsErr1 = document.getElementById('mfsErr1');
    const mfsErr2 = document.getElementById('mfsErr2');
    const mfsErr3 = document.getElementById('mfsErr3');

    function showStep(stepNum) {
        if (mfsErr1) mfsErr1.style.display = 'none';
        if (mfsErr2) mfsErr2.style.display = 'none';
        if (mfsErr3) mfsErr3.style.display = 'none';

        if (mfsStep1) mfsStep1.style.display = (stepNum === 1) ? 'block' : 'none';
        if (mfsStep2) mfsStep2.style.display = (stepNum === 2) ? 'block' : 'none';
        if (mfsStep3) mfsStep3.style.display = (stepNum === 3) ? 'block' : 'none';
        if (mfsProcessingState) mfsProcessingState.style.display = 'none';

        if (mfsProgressLine && circle1 && circle2 && circle3) {
            if (stepNum === 1) {
                mfsProgressLine.style.width = '0%';
                circle1.style.background = themeColor; circle1.style.color = '#fff';
                circle2.style.background = '#cbd5e1'; circle2.style.color = '#64748b';
                circle3.style.background = '#cbd5e1'; circle3.style.color = '#64748b';
            } else if (stepNum === 2) {
                mfsProgressLine.style.width = '50%';
                circle1.style.background = '#34d399'; circle1.style.color = '#fff';
                circle2.style.background = themeColor; circle2.style.color = '#fff';
                circle3.style.background = '#cbd5e1'; circle3.style.color = '#64748b';
            } else if (stepNum === 3) {
                mfsProgressLine.style.width = '100%';
                circle1.style.background = '#34d399'; circle1.style.color = '#fff';
                circle2.style.background = '#34d399'; circle2.style.color = '#fff';
                circle3.style.background = themeColor; circle3.style.color = '#fff';
            }
        }
    }

    // Step 1 -> Confirm Number
    const next1Btn = document.getElementById('mfsNext1Btn');
    if (next1Btn && mfsAccountNumber) {
        next1Btn.addEventListener('click', () => {
            const num = mfsAccountNumber.value.trim();
            if (!num || num.length < 11) {
                if (mfsErr1) {
                    mfsErr1.textContent = "Please enter a valid 11-digit mobile number.";
                    mfsErr1.style.display = 'block';
                }
                return;
            }
            const displayEl = document.getElementById('mfsDisplayNumber');
            if (displayEl) displayEl.textContent = num.slice(0, 3) + 'XXXX' + num.slice(-4);
            showStep(2);
        });
    }

    // Step 2 -> Verify OTP
    const next2Btn = document.getElementById('mfsNext2Btn');
    if (next2Btn && mfsOtpCode) {
        next2Btn.addEventListener('click', () => {
            const otp = mfsOtpCode.value.trim();
            if (!otp || otp.length < 4) {
                if (mfsErr2) {
                    mfsErr2.textContent = "Please enter the verification OTP.";
                    mfsErr2.style.display = 'block';
                }
                return;
            }
            showStep(3);
        });
    }

    // Step 3 -> Confirm PIN & Finalize Payment
    const submitBtn = document.getElementById('mfsSubmitBtn');
    if (submitBtn && mfsPinCode) {
        submitBtn.addEventListener('click', async () => {
            const pin = mfsPinCode.value.trim();
            if (!pin || pin.length < 4) {
                if (mfsErr3) {
                    mfsErr3.textContent = "Please enter your account PIN.";
                    mfsErr3.style.display = 'block';
                }
                return;
            }

            if (mfsStep1) mfsStep1.style.display = 'none';
            if (mfsStep2) mfsStep2.style.display = 'none';
            if (mfsStep3) mfsStep3.style.display = 'none';
            if (mfsProcessingState) mfsProcessingState.style.display = 'block';

            try {
                const response = await fetch('/customer/payment/sslcommerz/finalize', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ encodedData })
                });

                const data = await response.json();

                if (data.success) {
                    if (data.redirectUrl) {
                        window.location.href = data.redirectUrl;
                    } else {
                        window.location.href = `/customer/payment/sslcommerz/receipt?orderId=${data.orderId}&transactionId=${encodeURIComponent(data.transactionId)}&amount=${data.amount}&method=${encodeURIComponent(data.paymentMethod)}`;
                    }
                } else {
                    alert('Payment verification failed: ' + (data.error || 'Unknown error'));
                    window.location.href = '/customer/checkout?payment_status=failed&gateway=sslcommerz';
                }
            } catch (err) {
                console.error("Finalize payment error:", err);
                alert('Network error during payment finalization. Please try again.');
                window.location.href = '/customer/checkout?payment_status=failed&gateway=sslcommerz';
            }
        });
    }

    // Cancel buttons
    document.querySelectorAll('#mfsCancelBtn1, #mfsCancelBtn2, #mfsCancelBtn3').forEach(btn => {
        btn.addEventListener('click', () => {
            if (confirm('Are you sure you want to cancel this payment?')) {
                window.location.href = '/customer/checkout?payment_status=cancelled&gateway=sslcommerz';
            }
        });
    });
});
