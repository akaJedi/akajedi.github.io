+++
title =  "Подвал"
type = "footer"
draft = false
+++

{{< contact-section
    title="Связаться"
    contact_form_name="Ваше имя"
    contact_form_email="Ваш e-mail"
    contact_form_message="Ваше сообщение"
    contact_form_phone="Ваш телефон"
    contact_button="Отправить"
	  form_action="https://green-rice-1ea7.denis-f21.workers.dev"
    form_method="POST"
    contact_form_rows="2"
>}}




<script>
document.addEventListener("DOMContentLoaded", function () {
  const form = document.querySelector(".contact__form");
  const messageBox = document.getElementById("message");

  if (!form || !messageBox) {
    console.error("Форма или блок сообщений не найден");
    return;
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const nameInput = form.querySelector("[name='full_name']");
    const emailInput = form.querySelector("[name='email']");
    const phoneInput = form.querySelector("[name='phone']");
    const messageInput = form.querySelector("[name='message']");

    if (!nameInput || !emailInput || !messageInput) {
      console.error("Обязательные поля формы не найдены");
      messageBox.textContent = "❌ Ошибка формы. Обновите страницу.";
      messageBox.style.color = "red";
      return;
    }

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const phone = phoneInput.value.trim();
    const message = messageInput.value.trim();

    if (!name || !email || !message) {
      messageBox.textContent = "❗Пожалуйста, заполните имя, email и сообщение.";
      messageBox.style.color = "red";
      return;
    }

    const data = {
      name: name,
      email: email,
      phone: phone,
      message: message
    };

    messageBox.textContent = "Отправка...";
    messageBox.style.color = "#478079";

    try {
      console.log("Отправка на:", form.action);
      console.log("Данные:", data);

      const response = await fetch(form.action, {
        method: form.method,
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(data),
      });

      console.log("Статус ответа:", response.status);
      const result = await response.json();
      console.log("Результат:", result);

      if (result.success || response.ok) {
        messageBox.textContent = "✅ Ваше сообщение успешно отправлено!";
        messageBox.style.color = "green";
        form.reset();
      } else {
        messageBox.textContent = `❌ ${result.error || result.message || 'Что-то пошло не так. Попробуйте снова.'}`;
        messageBox.style.color = "red";
      }
    } catch (error) {
      console.error("Ошибка отправки формы:", error);
      console.error("Детали ошибки:", error.message, error.stack);
      messageBox.textContent = `⚠️ Не удалось отправить. ${error.message || 'Ошибка сети.'}`;
      messageBox.style.color = "red";
    }
  });
});
</script>
