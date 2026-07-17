const snippetMaxLength = 160;

const fuseOptions = {
  shouldSort: true,
  includeMatches: false,
  threshold: 0.35,
  ignoreLocation: true,
  minMatchCharLength: 2,
  keys: [
    { name: "title", weight: 0.9 },
    { name: "description", weight: 0.8 },
    { name: "summary", weight: 0.7 },
    { name: "contents", weight: 0.45 },
    { name: "tags", weight: 0.2 },
    { name: "categories", weight: 0.2 },
  ],
};

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(", ");
  }

  return normalizeText(value);
}

const sectionSnippets = {
  About: "IT Systems Operations Engineer focused on infrastructure, automation, and cloud operations.",
  "Обо мне": "Специалист по IT-операциям и инфраструктуре, автоматизации и облачным системам.",
  "My Expirience": "Career history in IT operations, infrastructure engineering, support, and enterprise migrations.",
  "Мой опыт в сфере IT": "История карьеры в IT-операциях, инфраструктуре, поддержке и крупных миграциях.",
  "Technical Skills": "Cloud, support, security, automation, and DevOps skills across enterprise environments.",
  Resumes: "Downloadable resumes for hardware deployment and DevOps/platform roles.",
  Blog: "Technical notes, project writeups, and career reflections on infrastructure and automation.",
  "Добро пожаловть. Спасибо что зашли.": "Технические заметки, разборы проектов и размышления о карьере и автоматизации.",
};

function buildSnippet(item) {
  const source = normalizeText(
    item.description || item.summary || item.contents || sectionSnippets[item.title] || "",
  );

  if (!source) {
    return "No preview available";
  }

  if (source.length <= snippetMaxLength) {
    return source;
  }

  const slice = source.slice(0, snippetMaxLength);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > 60 ? slice.slice(0, lastSpace) : slice;

  return `${cut.trim()}…`;
}

// Display error message in the search results container
function displayError(message) {
  const searchResultsElement = document.getElementById("search-results");
  if (searchResultsElement) {
    const sanitizedMessage = DOMPurify.sanitize(message);
    searchResultsElement.innerHTML = `<div class="alert alert-danger">${sanitizedMessage}</div>`;
  } else {
    console.error("Search results container not found");
  }
}

function getElement(id) {
  const element = document.getElementById(id);
  if (!element) {
    console.error(`Element with ID '${id}' not found`);
  }
  return element;
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function updateURL(query) {
  try {
    const url = new URL(window.location.href);

    if (query && query.length >= 2) {
      url.searchParams.set("s", query);
    } else {
      url.searchParams.delete("s");
    }

    window.history.replaceState({}, "", url.toString());
  } catch (error) {
    console.error("Error updating URL:", error);
  }
}

function param(name) {
  try {
    const paramValue = (location.search.split(`${name}=`)[1] || "").split("&")[0];
    return paramValue ? decodeURIComponent(paramValue).replace(/\+/g, " ") : "";
  } catch (error) {
    console.error(`Error parsing URL parameter '${name}':`, error);
    return "";
  }
}

function render(templateString, data) {
  try {
    if (!templateString || !data) {
      throw new Error("Invalid template or data");
    }

    let conditionalMatches, conditionalPattern, copy;
    conditionalPattern = /\$\{\s*isset ([a-zA-Z]*) \s*\}(.*)\$\{\s*end\s*}/g;
    copy = templateString;

    while ((conditionalMatches = conditionalPattern.exec(templateString)) !== null) {
      if (conditionalMatches.length < 3) continue;

      if (data[conditionalMatches[1]]) {
        copy = copy.replace(conditionalMatches[0], conditionalMatches[2]);
      } else {
        copy = copy.replace(conditionalMatches[0], "");
      }
    }

    let result = copy;

    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const value = data[key];
        if (value !== undefined && value !== null) {
          const find = `\\$\\{\\s*${key}\\s*\\}`;
          const re = new RegExp(find, "g");
          result = result.replace(re, escapeHTML(value));
        }
      }
    }

    return result;
  } catch (error) {
    console.error("Error rendering template:", error);
    return '<div class="alert alert-danger">Error rendering result</div>';
  }
}

function populateResults(result, searchQuery) {
  try {
    if (!Array.isArray(result)) {
      throw new Error("Invalid search results");
    }

    const searchResults = getElement("search-results");
    if (!searchResults) {
      throw new Error("Search results container not found");
    }

    const templateElement = document.getElementById("search-result-template");
    if (!templateElement) {
      throw new Error("Search result template not found");
    }
    const templateDefinition = templateElement.innerHTML;

    for (const [key, value] of result.entries()) {
      if (!value || !value.item) {
        console.warn("Skipping invalid search result item", value);
        continue;
      }

      const item = value.item;
      const snippet = buildSnippet(item);

      try {
        const output = render(templateDefinition, {
          key,
          title: item.title || "Untitled",
          link: item.link || item.permalink || "#",
          tags: normalizeList(item.tags),
          categories: normalizeList(item.categories),
          snippet,
        });
        searchResults.insertAdjacentHTML("beforeend", output);

        if (searchQuery && typeof Mark !== "undefined") {
          try {
            const summaryElem = document.getElementById(`summary-${key}`);
            if (summaryElem) {
              const markInstance = new Mark(summaryElem);
              markInstance.mark(searchQuery);
            }
          } catch (e) {
            console.warn("Error highlighting text:", e);
          }
        }
      } catch (error) {
        console.error("Error rendering search result:", error);
      }
    }
  } catch (error) {
    console.error("Error populating results:", error);
    displayError("There was a problem displaying search results.");
  }
}

function executeSearch(searchQuery) {
  try {
    if (!searchQuery || typeof searchQuery !== "string") {
      throw new Error("Invalid search query");
    }

    const searchResults = getElement("search-results");
    if (!searchResults) {
      throw new Error("Search results container not found");
    }

    searchResults.innerHTML =
      '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>';

    fetch("/index.json")
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            `Network response was not ok: ${response.status} ${response.statusText}`,
          );
        }
        return response.json();
      })
      .then((data) => {
        if (!Array.isArray(data)) {
          throw new Error("Received invalid data format from server");
        }

        const fuse = new Fuse(data, fuseOptions);
        const result = fuse.search(searchQuery);

        searchResults.innerHTML = "";

        if (result.length > 0) {
          populateResults(result, searchQuery);
        } else {
          searchResults.insertAdjacentHTML(
            "beforeend",
            "<div class='alert'>No matches found</div>",
          );
        }
      })
      .catch((error) => {
        console.error("Error executing search:", error);
        displayError(`Failed to search: ${error.message}`);
      });
  } catch (error) {
    console.error("Error in search execution:", error);
    displayError("There was a problem with the search. Please try again later.");
  }
}

const searchQuery = param("s");
try {
  const searchInput = getElement("search-query");
  const searchResults = getElement("search-results");

  if (searchInput && searchQuery) {
    searchInput.value = searchQuery;
    executeSearch(searchQuery);
  } else if (searchResults) {
    searchResults.innerHTML =
      "<div class='alert'>Please enter at least 2 characters to search</div>";
  }
} catch (error) {
  console.error("Error initializing search:", error);
  displayError(
    "There was a problem initializing the search. Please try again later.",
  );
}

document.addEventListener("DOMContentLoaded", () => {
  try {
    const searchInput = getElement("search-query");
    if (!searchInput) {
      throw new Error("Search input not found");
    }

    const debouncedSearch = debounce((query) => {
      updateURL(query);

      const searchResults = getElement("search-results");
      if (!searchResults) {
        throw new Error("Search results container not found");
      }

      if (query.length >= 2) {
        executeSearch(query);
      } else if (query.length === 0 || query.length === 1) {
        searchResults.innerHTML =
          "<div class='alert'>Please enter at least 2 characters to search</div>";
      }
    }, 300);

    searchInput.addEventListener("input", function () {
      const query = this.value.trim();
      debouncedSearch(query);
    });

    const searchForm = searchInput.closest("form");
    if (searchForm) {
      searchForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (query.length >= 2) {
          updateURL(query);
          executeSearch(query);
        }
      });
    }
  } catch (error) {
    console.error("Error setting up search event listeners:", error);
    displayError(
      "There was a problem setting up the search functionality. Please try reloading the page.",
    );
  }
});
