export const supportedPlatformProviders = [
  {
    uid: '2d8310cb-844f-49c1-a462-8d6a0166db00',
    name: 'KUBERNETES',
    displayName: 'Standard Kubernetes',
    regions: [
      {
        uid: 'f9c53575-37a7-4f0f-b77f-1cf8cc786e06',
        name: 'local',
        displayName: 'Cluster local',
      }
    ]
  },
  {
    uid: '8ad0b3a3-3b3c-47ba-99ec-754dcf09a5b1',
    name: 'AWS_EKS',
    displayName: 'Amazon Elastic Kubernetes Service (EKS)',
    regions: [
      {
        uid: '1fa42981-f87d-4cec-8ebe-3eb262037ce3',
        name: 'ap-southeast-1',
        displayName: 'Singapore',
      }
    ]
  },
  {
    uid: 'c4c44b87-30e4-47a2-a137-72fb7cf62e3c',
    name: 'ALICLOUD_ACK',
    displayName: 'Alibaba Cloud Container Service for Kubernetes (ACK)',
    regions: [
      {
        uid: '5e9b5a0a-48da-468b-b539-878e60559362',
        name: 'cn-hangzhou',
        displayName: 'China (Hangzhou)',
      },
      {
        uid: '20a2ee6b-ac4b-468e-bbcf-001f4ae8f0d3',
        name: 'ap-southeast-1',
        displayName: 'Singapore',
      },
      {
        uid: '0026df5d-ecf5-44a1-9009-7b2da6fb40c8',
        name: 'ap-southeast-5',
        displayName: 'Jakarta',
      }
    ]
  },
];
