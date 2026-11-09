import { type SectionConfig } from "@/components/settings/sections";
import { SettingsSecret } from "@/components/settings/secret-field";
import { SettingsActions } from "@/components/settings/settings-actions";
import { SettingsFields } from "@/components/settings/settings-fields";
import {
  type StoredSection,
  secretStatusOf,
  useSettingsForm,
} from "@/components/settings/use-settings-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface SettingsCardProps {
  config: SectionConfig;
  stored: StoredSection;
}

/** One section of Settings (Cloudflare R2 or GitHub): a form of its fields and secret, with Save and Test connection. */
export function SettingsCard({ config, stored }: SettingsCardProps) {
  const { form, save, test, clearResults } = useSettingsForm(config, stored);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{config.title}</CardTitle>
        <CardDescription>{config.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <SettingsFields form={form} config={config} onEdit={clearResults} />
          <SettingsSecret
            form={form}
            config={config}
            status={secretStatusOf(config, stored)}
            onEdit={clearResults}
          />
          <SettingsActions form={form} config={config} save={save} test={test} />
        </form>
      </CardContent>
    </Card>
  );
}
