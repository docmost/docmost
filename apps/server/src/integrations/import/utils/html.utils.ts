import { Window, DOMParser } from 'happy-dom';

function transformTaskList(html: string): string {
  const window = new Window();
  const doc = new DOMParser(window).parseFromString(html, 'text/html');

  const ulElements = doc.querySelectorAll('ul');
  ulElements.forEach((ul) => {
    let isTaskList = false;

    const liElements = ul.querySelectorAll('li');
    liElements.forEach((li) => {
      const checkbox = li.querySelector('input[type="checkbox"]');

      if (checkbox) {
        isTaskList = true;
        // Add taskItem data type
        li.setAttribute('data-type', 'taskItem');
        // Set data-checked attribute based on the checkbox state
        // @ts-ignore
        li.setAttribute('data-checked', checkbox.checked ? 'true' : 'false');
        // Remove the checkbox from the li
        checkbox.remove();

        // Move the content of <p> out of the <p> and remove <p>
        const pElements = li.querySelectorAll('p');
        pElements.forEach((p) => {
          // Append the content of the <p> element to its parent (the <li> element)
          while (p.firstChild) {
            li.appendChild(p.firstChild);
          }
          // Remove the now empty <p> element
          p.remove();
        });
      }
    });

    // If any <li> contains a checkbox, mark the <ul> as a task list
    if (isTaskList) {
      ul.setAttribute('data-type', 'taskList');
    }
  });

  return doc.body.innerHTML;
}

function transformCallouts(html: string): string {
  const window = new Window();
  const doc = new DOMParser(window).parseFromString(html, 'text/html');

  const calloutRegex = /:::(\w+)\s*([\s\S]*?)\s*:::/g;

  const createCalloutDiv = (type: string, content: string): HTMLElement => {
    const div = doc.createElement('div');
    div.setAttribute('data-type', 'callout');
    div.setAttribute('data-callout-type', type);
    const p = doc.createElement('p');
    p.textContent = content.trim();
    div.appendChild(p);
    return div as unknown as HTMLElement;
  };

  const pElements = doc.querySelectorAll('p');

  pElements.forEach((p) => {
    if (calloutRegex.test(p.innerHTML) && !p.closest('ul, ol')) {
      calloutRegex.lastIndex = 0;
      const [, type, content] = calloutRegex.exec(p.innerHTML) || [];
      const calloutDiv = createCalloutDiv(type, content);
      // @ts-ignore
      p.replaceWith(calloutDiv);
    }
  });

  return doc.body.innerHTML;
}

export function transformHTML(html: string): string {
  return transformTaskList(transformCallouts(html));
}
