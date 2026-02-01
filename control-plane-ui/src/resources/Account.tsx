import { RecordField, Show } from "@/components/admin"

export const Account = () => {
  return (
    <Show>
      <div className="flex flex-col gap-4">
        <RecordField source="description" className="max-w-100" />
      </div>
    </Show>
  )
}