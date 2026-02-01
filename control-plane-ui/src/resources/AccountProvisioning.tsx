import { BooleanInput, Create, ReferenceInput, SelectInput, SimpleForm, TextInput } from "@/components/admin"
import { generateAccountId } from "@/lib/generator";
import { FormDataConsumer, useCreate } from "ra-core"
import { useRef } from "react";
import { useNavigate } from "react-router";

export const AccountProvisioning = () => {
  const [create] = useCreate();
  const navigate = useNavigate()
  const accountSave = (formData: any) => {
    // @ts-ignore eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { generateExtId, ...data } = formData;
    if (generateExtId) {
      data.extAccountId = extIdRef.current;
    }

    console.log(formData, data)
    create('admin/accounts', { data }, {
      onSuccess: () => navigate('/admin/accounts')
    });
  };

  const extIdRef = useRef<string>(generateAccountId());

  return (
    <Create title="Provision new account">
      <SimpleForm
        defaultValues={{
          generateExtId: true,
          extAccountId: extIdRef.current,
        }}
        onSubmit={accountSave}
      >
        <TextInput source="accountName" label="Account name" required={true} placeholder="my-account" />

        <BooleanInput source="generateExtId" label="Generate external account ID" />

        <FormDataConsumer>
          {({ formData }) =>
            formData.generateExtId ? (
              <TextInput
                source="extAccountId"
                label="External account ID"
                disabled
              />
            ) : (
              <TextInput
                source="extAccountId"
                label="External account ID"
                placeholder="Leave empty for auto generated"
              />
            )
          }
        </FormDataConsumer>

        <TextInput source="initialAccountOwnerEmail" label="Initial account owner email" type="email" required={true} placeholder="joe@example.com" />
        <SelectInput
          source="accountPlan"
          label="Plan"
          choices={[
            { id: 'enterprise', name: 'ENTERPRISE' }
          ]}
          defaultValue='enterprise'
        />

        {/* Platform provider selection */}
        <ReferenceInput
          reference="platformProviders"
          source="platformProviderUid"
        >
          <SelectInput label="Platform provider" />
        </ReferenceInput>

        {/* Platform provider region selection based on selected platform provider */}
        <FormDataConsumer<{ platformProviderUid: string }>>
          {({ formData }) => {
            if (formData.platformProviderUid) {
              return (
                <ReferenceInput
                  reference={`platformProviders/${formData.platformProviderUid}/regions`}
                  source="platformProviderRegionUid"
                >
                  <SelectInput label="Platform provider region" />
                </ReferenceInput>
              )
            }
          }}
        </FormDataConsumer>
      </SimpleForm>
    </Create>
  )
}
