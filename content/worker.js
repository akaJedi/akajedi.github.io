+++
title =  "Footer"
type = "footer"
draft = false
+++

<div id="form-status" style="margin: 1rem 0; font-weight: bold;"></div>
{{< contact-section
    title="Reach out" 
    contact_form_name="Your name"
    contact_form_email="Your e-mail"
    contact_form_message="Your text"
    contact_form_phone="Your phone"
    contact_button="Send message"
    form_action="https://green-rice-1ea7.denis-f21.workers.dev"
    form_method="POST"
    contact_form_rows="2"
>}}



<script>
document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("form[action='https://green-rice-1ea7.denis-f21.workers.dev']");
  const status = document.getElementById("form-status");
  const submitBtn = form?.querySelector("button[type='submit']");

  if (!form || !status || !submitBtn) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.textContent = '';
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending...";

    const formData = Object.fromEntries(new FormData(form).entries());

    try {
      const res = await fetch(form.action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        form.reset();
        status.style.color = "green";
        status.textContent = "✅ Message sent successfully!";
      } else {
        status.style.color = "red";
        status.textContent = "❌ Something went wrong. Please try again.";
      }
    } catch (err) {
      status.style.color = "red";
      status.textContent = "❌ Network error. Please try again.";
    }

    submitBtn.disabled = false;
    submitBtn.textContent = "Send message";
  });
});
</script>
