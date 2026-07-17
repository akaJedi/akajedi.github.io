+++
title = "Главная"
type = "home"
draft = false
translationKey = "homepage"
+++

<section class="summer-hero" aria-labelledby="summer-hero-title">
  <div class="summer-hero__copy">
    <p class="summer-kicker">Инфраструктура / Эксплуатация / Автоматизация</p>
    <h1 id="summer-hero-title">Денис Толочко</h1>
    <p class="summer-hero__role">Инженер по эксплуатации ИТ-систем</p>
    <p class="summer-hero__lead">Создаю надёжную инфраструктуру, облачные процессы и автоматизацию для команд, которым нужны спокойные и предсказуемые технологии.</p>
    <div class="summer-hero__actions" aria-label="Основные разделы">
      <a href="/ru/about/">Обо мне</a>
      <a href="/skills/">Навыки</a>
      <a href="/ru/blog/">Заметки</a>
    </div>
  </div>
  <div class="summer-signal">
    <div class="summer-signal__ring summer-signal__ring--one" data-signal-wheel role="button" tabindex="0" aria-label="Проведите вниз, чтобы ускорить колесо"></div>
    <div class="summer-signal__ring summer-signal__ring--two" aria-hidden="true"></div>
    <div class="summer-signal__panel" data-signal-carousel data-interval="10000" data-pause-label="Остановить слайд-шоу" data-resume-label="Продолжить слайд-шоу">
      <div class="summer-signal__slides" aria-live="off">
        <div class="summer-signal__slide is-active" data-signal-slide aria-hidden="false">
          <span class="summer-signal__label">Глубина опыта</span>
          <strong>15+ лет</strong>
          <span>системы, поддержка, облака и автоматизация</span>
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
      </div>
      <div class="summer-signal__controls">
        <span class="summer-signal__lights" aria-hidden="true">
          <i class="is-active"></i><i></i><i></i>
        </span>
        <button type="button" class="summer-signal__toggle" data-signal-toggle aria-label="Остановить слайд-шоу" aria-pressed="false"></button>
      </div>
      <div class="summer-signal__sets" data-signal-sets role="group" aria-label="Набор звуков">
        <button type="button" class="is-active" data-signal-set="0" aria-pressed="true"><span>01</span><small>ЛУПЫ</small></button>
        <button type="button" data-signal-set="1" aria-pressed="false"><span>02</span><small>FX</small></button>
        <button type="button" data-signal-set="2" aria-pressed="false"><span>03</span><small>CHILL</small></button>
      </div>
    </div>
    <div class="summer-signal__grid" data-signal-pads role="group" aria-label="Звуковые пэды">
      <span></span><span></span><span></span><span></span>
      <span></span><span></span><span></span><span></span>
      <span></span><span></span><span></span><span></span>
    </div>
  </div>
</section>

<section class="summer-band summer-band--intro">
  <div class="summer-band__eyebrow">Текущая роль</div>
  <div class="summer-band__content">
    <h2>Превращаю облачный хаос в предсказуемые системы.</h2>
    <p>Работаю с инфраструктурой как кодом, AWS и Azure, DevOps-процессами, безопасным администрированием и практичной автоматизацией. Цель проста: скучные развёртывания и системы, которым можно доверять.</p>
  </div>
</section>

<section class="summer-capabilities" aria-label="Основные компетенции">
  <article>
    <span>01</span>
    <h3>Инфраструктура</h3>
    <p>Облачные и гибридные системы, идентификация, конечные устройства, виртуализация, сети и дисциплина эксплуатации.</p>
  </article>
  <article>
    <span>02</span>
    <h3>Автоматизация</h3>
    <p>Скрипты, повторяемые процессы, инфраструктура как код, мониторинг и небольшие инструменты, устраняющие ручную работу.</p>
  </article>
  <article>
    <span>03</span>
    <h3>Сигналы риска</h3>
    <p>Безопасность, надёжность, резервное копирование, инциденты, зависимости и слабые сигналы будущих сбоев.</p>
  </article>
</section>

<section class="summer-proof">
  <div>
    <p class="summer-kicker">Профессиональный путь</p>
    <h2>Опыт в поддержке, системах и технологических переходах.</h2>
  </div>
  <div class="summer-proof__links">
    <a href="/ru/experience/">Опыт</a>
    <a href="/resume/">Резюме</a>
    <a href="/ru/now/">Сейчас</a>
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
    {{< link icon="square-github" url="https://github.com/akajedi" >}}
    {{< link icon="linkedin" url="https://www.linkedin.com/in/denistolochko" >}}
    {{< link icon="square-twitter" url="https://twitter.com/denistolochko" >}}
    {{< link icon="email" url="/ru/contact/" >}}
  {{< /platform-links >}}
</section>
