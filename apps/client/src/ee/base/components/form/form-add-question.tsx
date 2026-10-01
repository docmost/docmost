import { useRef } from "react";
import { Button, Menu, ScrollArea } from "@mantine/core";
import { IconListCheck, IconPlus } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import {
  BasePropertyType,
  FormFieldConfig,
  IBase,
} from "@/ee/base/types/base.types";
import {
  getDescriptor,
  PROPERTY_PICKER_ORDER,
} from "@/ee/base/property-types/property-type.registry";
import { CreatePropertyPopover } from "@/ee/base/components/property/create-property-popover";
import {
  FORM_FIELD_TYPES,
  MAX_FORM_FIELDS,
  isFormFieldProperty,
} from "@/ee/base/components/form/form-definition";

const NON_FORM_PROPERTY_TYPES = new Set<BasePropertyType>(
  PROPERTY_PICKER_ORDER.filter((type) => !FORM_FIELD_TYPES.has(type)),
);

type FormAddQuestionProps = {
  base: IBase;
  fields: FormFieldConfig[];
  pageId: string;
  onAdd: (propertyIds: string[]) => void;
};

export function FormAddQuestion({
  base,
  fields,
  pageId,
  onAdd,
}: FormAddQuestionProps) {
  const { t } = useTranslation();
  const anchorRef = useRef<HTMLDivElement>(null);
  const used = new Set(fields.map((field) => field.propertyId));
  const unused = base.properties.filter((p) => !used.has(p.id));
  const available = unused.filter(isFormFieldProperty);
  const unavailable = unused.filter((p) => !isFormFieldProperty(p));
  const remaining = MAX_FORM_FIELDS - fields.length;

  return (
    <CreatePropertyPopover
      pageId={pageId}
      properties={base.properties}
      excludeTypes={NON_FORM_PROPERTY_TYPES}
      onPropertyCreated={(property) => onAdd([property.id])}
      renderTarget={(openCreate) => (
        <div ref={anchorRef}>
          <Menu
            position="bottom-start"
            width={280}
            shadow="md"
            withinPortal
            returnFocus={false}
          >
            <Menu.Target>
              <Button
                variant="subtle"
                color="gray"
                leftSection={<IconPlus size={16} />}
                disabled={remaining <= 0}
              >
                {t("Add question")}
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <ScrollArea.Autosize mah={320} type="auto">
                {available.length > 0 && (
                  <Menu.Label>{t("Add a property")}</Menu.Label>
                )}
                {available.map((property) => {
                  const Icon = getDescriptor(property.type)?.icon;
                  return (
                    <Menu.Item
                      key={property.id}
                      leftSection={Icon ? <Icon size={14} /> : undefined}
                      onClick={() => onAdd([property.id])}
                    >
                      {property.name}
                    </Menu.Item>
                  );
                })}
                {available.length > 1 && (
                  <Menu.Item
                    leftSection={<IconListCheck size={14} />}
                    onClick={() =>
                      onAdd(available.slice(0, remaining).map((p) => p.id))
                    }
                  >
                    {t("Add all properties")}
                  </Menu.Item>
                )}
                {unavailable.length > 0 && (
                  <>
                    <Menu.Label>{t("Not available in forms")}</Menu.Label>
                    {unavailable.map((property) => {
                      const Icon = getDescriptor(property.type)?.icon;
                      return (
                        <Menu.Item
                          key={property.id}
                          leftSection={Icon ? <Icon size={14} /> : undefined}
                          disabled
                        >
                          {property.name}
                        </Menu.Item>
                      );
                    })}
                  </>
                )}
              </ScrollArea.Autosize>
              {unused.length > 0 && <Menu.Divider />}
              <Menu.Item
                leftSection={<IconPlus size={14} />}
                onClick={() => openCreate(anchorRef.current ?? undefined)}
              >
                {t("New property")}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </div>
      )}
    />
  );
}
