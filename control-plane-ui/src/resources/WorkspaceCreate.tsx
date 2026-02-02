import { BooleanInput, Create, SimpleForm, TextInput } from "@/components/admin"
import { generateWorkspaceId } from "@/lib/generator";
import { FormDataConsumer, useCreate } from "ra-core";
import { useRef } from "react";
import { useNavigate } from "react-router";

export const WorkspaceProvisioning = () => {
  const [create] = useCreate();
  const navigate = useNavigate()
  const workspaceSave = (formData: any) => {
    // @ts-ignore eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { generateExtId, ...data } = formData;
    data.extAccountId = localStorage.getItem('realm');
    if (generateExtId) {
      data.extWorkspaceId = extIdRef.current;
    }

    console.log(formData, data)
    create('workspaces', { data }, {
      onSuccess: () => navigate('/workspaces'),
      onError: () => {}
    });
  };

  const extIdRef = useRef<string>(generateWorkspaceId());

  return (
    <Create title="Provision new workspace">
      <SimpleForm
        defaultValues={{
          extAccountId: localStorage.getItem('realm'),
          generateExtId: true,
          extWorkspaceId: extIdRef.current,
        }}
        onSubmit={workspaceSave}
      >
        <TextInput source="extAccountId" label="Account" disabled required />

        <TextInput source="name" label="Workspace name" placeholder="my-workspace" required />
        <TextInput source="description" label="Workspace description" placeholder="Workspace description" />

        <BooleanInput source="generateExtId" label="Generate external workspace ID" />

        <FormDataConsumer>
          {({ formData }) =>
            formData.generateExtId ? (
              <TextInput
                source="extWorkspaceId"
                label="External workspace ID"
                disabled
              />
            ) : (
              <TextInput
                source="extWorkspaceId"
                label="External workspace ID"
                placeholder="Leave empty for auto generated"
              />
            )
          }
        </FormDataConsumer>

      </SimpleForm>
    </Create>
  )
}