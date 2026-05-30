import { useMemo } from "react"
import { Input } from "@/components/ui/input"

interface ModelSelectInputProps {
  value: string
  options: string[]
  selectPlaceholder: string
  inputPlaceholder: string
  onChange: (value: string) => void
}

export function ModelSelectInput({
  value,
  options,
  selectPlaceholder,
  inputPlaceholder,
  onChange,
}: ModelSelectInputProps) {
  const mergedOptions = useMemo(
    () => Array.from(new Set([value, ...options].map((item) => item.trim()).filter(Boolean))),
    [options, value],
  )

  return (
    <div className="flex flex-col gap-2 lg:flex-row">
      <select
        value={value.trim() || "__empty__"}
        onChange={(event) => onChange(event.target.value === "__empty__" ? "" : event.target.value)}
        className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm lg:w-72"
      >
        <option value="__empty__">{selectPlaceholder}</option>
        {mergedOptions.map((model) => (
          <option key={model} value={model}>
            {model}
          </option>
        ))}
      </select>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={inputPlaceholder}
        className="w-full"
      />
    </div>
  )
}
