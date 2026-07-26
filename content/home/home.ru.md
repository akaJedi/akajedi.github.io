+++
title = "Главная"
type = "home"
draft = false
translationKey = "homepage"
+++

<section class="summer-hero" aria-labelledby="summer-hero-title">
  <div class="summer-hero__copy">
    <p class="summer-kicker">Бесплатные инструменты для инженеров</p>
    <h1 id="summer-hero-title">F12</h1>
    <p class="summer-hero__role">Небольшой набор инструментов, который постоянно растёт</p>
    <p class="summer-hero__lead">Простые, честные инструменты для повседневных мелочей инфраструктурной и IT-работы — проверить IP, посчитать подсеть, безопасно сгенерировать пароль. Без аккаунтов, без навязчивых предложений, без тёмных паттернов.</p>
    <p class="summer-hero__context">Всё здесь работает на стороне клиента, где это возможно, и честно говорит, что отправляется куда-либо, а что нет. Если это экономит инженеру пять минут в два часа ночи — цель достигнута.</p>
    <p class="summer-hero__note">Создаётся и поддерживается <a href="/ru/author/">Денисом Толочко</a>, IT Systems Operations Engineer — <a href="/ru/contact/">напишите мне</a> или <a href="/ru/tools/">посмотрите инструменты</a>.</p>
  </div>
  <div class="summer-signal">
    <div class="summer-signal__ring summer-signal__ring--one" data-signal-wheel role="button" tabindex="0" aria-label="Проведите вниз, чтобы ускорить колесо"></div>
    <div class="summer-signal__panel" data-signal-carousel data-interval="10000" data-pause-label="Остановить слайд-шоу" data-resume-label="Продолжить слайд-шоу">
      <div class="summer-signal__slides" aria-live="off">
        <div class="summer-signal__slide is-active" data-signal-slide aria-hidden="false">
          <span class="summer-signal__label">Фокус эксплуатации</span>
          <strong>Надёжные системы</strong>
          <span>инфраструктура, которой удобно управлять и доверять</span>
        </div>
        <div class="summer-signal__slide" data-signal-slide aria-hidden="true">
          <span class="summer-signal__label">Модель реализации</span>
          <strong>Cloud + IaC</strong>
          <span>повторяемые среды с меньшим числом сюрпризов</span>
        </div>
        <div class="summer-signal__slide" data-signal-slide aria-hidden="true">
          <span class="summer-signal__label">Практика надёжности</span>
          <strong>Контроль + восстановление</strong>
          <span>мониторинг, резервные копии и готовность к инцидентам</span>
        </div>
        <div class="summer-signal__slide" data-signal-slide aria-hidden="true">
          <span class="summer-signal__label">Принцип автоматизации</span>
          <strong>Меньше рутины</strong>
          <span>небольшие инструменты, которые возвращают время команде</span>
        </div>
        <div class="summer-signal__slide" data-signal-slide aria-hidden="true">
          <span class="summer-signal__label">Подход к безопасности</span>
          <strong>Минимум привилегий</strong>
          <span>осмысленное управление идентификацией и доступом</span>
        </div>
        <div class="summer-signal__slide" data-signal-slide aria-hidden="true">
          <span class="summer-signal__label">Формат сотрудничества</span>
          <strong>Понятная передача</strong>
          <span>документация и контекст остаются вместе с работой</span>
        </div>
      </div>
      <div class="summer-signal__controls">
        <span class="summer-signal__lights" aria-hidden="true">
          <i class="is-active"></i><i></i><i></i><i></i><i></i><i></i>
        </span>
        <button type="button" class="summer-signal__toggle" data-signal-toggle aria-label="Остановить слайд-шоу" aria-pressed="false"></button>
      </div>
    </div>
    <div class="summer-signal__grid" data-signal-pads data-coffee-label="Кофейная мелодия" role="group" aria-label="Интерактивные цветные плитки">
      <span></span><span></span><span></span><span></span>
      <span></span><span></span><span></span><span></span>
      <span></span><span></span><span></span><span></span>
    </div>
  </div>
</section>

<section class="summer-band summer-band--intro">
  <div class="summer-band__eyebrow">Зачем существует F12</div>
  <div class="summer-band__content">
    <h2>Небольшие инструменты, которыми реально пользуются.</h2>
    <p>Большая часть инженерных мелочей повторяется день за днём: проверить соединение, посчитать подсеть, сгенерировать по-настоящему случайный пароль. F12 — растущий набор инструментов именно для этого: быстрых, бесплатных и сделанных так, как я сам хотел бы, чтобы их сделали.</p>
  </div>
</section>

{{< tools-preview >}}

<section class="summer-proof">
  <div>
    <p class="summer-kicker">Кто за этим стоит</p>
    <h2><a href="/ru/author/">Денис Толочко</a>, IT Systems Operations Engineer.</h2>
  </div>
  <div class="summer-proof__links">
    <a href="/ru/author/">Автор</a>
    <a href="/ru/experience/">Опыт</a>
    <a href="/resume/">Резюме</a>
  </div>
</section>

<section class="summer-notes">
  <div class="summer-notes__visual" aria-hidden="true">
    <span></span><span></span><span></span><span></span>
  </div>
  <div>
    <p class="summer-kicker">Заметки и исследования</p>
    <h2>Пишу об инфраструктуре, эксплуатации и работе за кулисами.</h2>
    <p>Короткие технические заметки, размышления о карьере и практическая документация из системной работы.</p>
    <a class="summer-read-more" href="/ru/blog/">Читать блог</a>
  </div>
</section>

<section class="summer-social" aria-label="Профили и контакты">
  {{< platform-links >}}
    {{< link icon="square-github" label="GitHub" url="https://github.com/akajedi" >}}
    {{< link icon="linkedin" label="LinkedIn" url="https://www.linkedin.com/in/denistolochko" >}}
    {{< link icon="square-twitter" label="Twitter" url="https://twitter.com/denistolochko" >}}
    {{< link icon="email" label="Открыть чат на сайте" url="/ru/contact/" >}}
  {{< /platform-links >}}
</section>
