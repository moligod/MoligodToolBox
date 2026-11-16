export function initActionPicker(
  category: HTMLSelectElement,
  action: HTMLSelectElement,
  changed: () => void,
) {
  const groups = [...action.querySelectorAll("optgroup")];
  const previous = action.value;
  const remembered = new Map<string, string>();
  let activeCategory = "";
  category.replaceChildren(
    ...groups.map((group) => new Option(group.label, group.dataset.category)),
  );
  function selectGroup(group: HTMLOptGroupElement, preferred?: string) {
    category.value = group.dataset.category!;
    activeCategory = category.value;
    action.replaceChildren(
      ...[...group.querySelectorAll("option")].map((option) =>
        option.cloneNode(true),
      ),
    );
    action.value = [...action.options].some(
      (option) => option.value === preferred,
    )
      ? preferred!
      : action.options[0].value;
    remembered.set(category.value, action.value);
    changed();
  }
  category.addEventListener("change", () => {
    remembered.set(activeCategory, action.value);
    const group = groups.find(
      (item) => item.dataset.category === category.value,
    )!;
    selectGroup(group, remembered.get(category.value));
  });
  action.addEventListener("change", () => {
    remembered.set(category.value, action.value);
    changed();
  });
  selectGroup(
    groups.find((group) =>
      [...group.querySelectorAll("option")].some(
        (option) => option.value === previous,
      ),
    ) ?? groups[0],
    previous,
  );
  return {
    select(type: string) {
      const group = groups.find((item) =>
        [...item.querySelectorAll("option")].some(
          (option) => option.value === type,
        ),
      );
      if (group) selectGroup(group, type);
    },
  };
}
