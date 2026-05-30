import { useTranslation } from "react-i18next"
import { currentVersionChangelog } from "@/lib/changelog"

export function ChangelogSection() {
  const { t, i18n } = useTranslation()
  const lang: "en" | "zh" = i18n.language?.startsWith("zh") ? "zh" : "en"
  const entries = currentVersionChangelog(__APP_VERSION__)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">
          {t("settings.sections.changelog.title", { defaultValue: "版本更新" })}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("settings.sections.changelog.description", {
            defaultValue: "这里展示当前版本值得关注的变化。",
          })}
        </p>
      </div>

      <div className="space-y-6">
        {entries.map((entry) => (
          <div
            key={entry.version}
            className="rounded-lg border border-border/60 bg-muted/20 p-4"
          >
            <div className="flex items-baseline gap-3">
              <span className="rounded bg-primary/15 px-2 py-0.5 text-sm font-semibold text-primary">
                v{entry.version}
              </span>
              <span className="text-xs text-muted-foreground">{entry.date}</span>
            </div>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-foreground/90">
              {entry.highlights[lang].map((line, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
