import { TextInput } from "@/components/admin";
import { Button } from "@/components/ui/button";
import { Form, required } from "ra-core";
import { FieldValues, SubmitHandler } from "react-hook-form";
import { useNavigate } from "react-router";

export const RealmGate = () => {
  const navigate = useNavigate();

  const handleSubmit: SubmitHandler<FieldValues> = (values) => {
    const realm = values.realm?.trim()
    if (!realm) return

    localStorage.setItem("realm", realm)
    // force full remount of <Admin>
    navigate("/", { replace: true })
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-100">
      <Form
        className="flex gap-2 scale-125"
        onSubmit={handleSubmit}
      >
        <TextInput inputClassName="bg-white" source="realm" placeholder="Enter realm" label={false} validate={required("Please enter realm")} />
        <Button type="submit" className="cursor-pointer">
          Enter
        </Button>
      </Form>
    </div>
  );
}