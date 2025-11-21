// Post killmail functionality
(function() {
    const input = document.getElementById('killmailInput');
    const submitButton = document.getElementById('submitButton');
    const postStatus = document.getElementById('postStatus');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const postError = document.getElementById('postError');
    const postSuccess = document.getElementById('postSuccess');

    if (!input || !submitButton) {
        return;
    }

    // Listen for paste events on the entire document
    document.addEventListener('paste', async function(e) {
        const pastedData = e.clipboardData.getData('text');
        if (pastedData && pastedData.trim()) {
            e.preventDefault();
            input.value = pastedData;
            // Auto-submit after paste
            await submitKillmail(pastedData);
        }
    });

    // Submit button click handler
    submitButton.addEventListener('click', async function() {
        const data = input.value.trim();
        if (data) {
            await submitKillmail(data);
        } else {
            showError('Please paste a valid ESI killmail URL');
        }
    });

    // Submit on Enter in textarea (Ctrl+Enter or Cmd+Enter)
    input.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            const data = input.value.trim();
            if (data) {
                submitKillmail(data);
            }
        }
    });

    async function submitKillmail(data) {
        // Show loading state
        postStatus.style.display = 'block';
        loadingSpinner.style.display = 'block';
        postError.style.display = 'none';
        postSuccess.style.display = 'none';
        submitButton.disabled = true;

        try {
            const response = await fetch('/post', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ data }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to post killmail');
            }

            if (result.success) {
                showSuccess('Killmail posted successfully! Redirecting...');
                // Redirect to the killmail page
                setTimeout(() => {
                    window.location.href = result.url;
                }, 1000);
            } else {
                throw new Error(result.error || 'Unknown error');
            }
        } catch (error) {
            showError(error.message || 'Failed to post killmail');
            submitButton.disabled = false;
        }
    }

    function showError(message) {
        loadingSpinner.style.display = 'none';
        postError.textContent = message;
        postError.style.display = 'block';
        postSuccess.style.display = 'none';
    }

    function showSuccess(message) {
        loadingSpinner.style.display = 'none';
        postError.style.display = 'none';
        postSuccess.textContent = message;
        postSuccess.style.display = 'block';
    }
})();
