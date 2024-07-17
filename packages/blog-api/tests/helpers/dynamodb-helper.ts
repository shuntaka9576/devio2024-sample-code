import { CreateTableCommand } from '@aws-sdk/client-dynamodb';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

export class DynamoDBClientHelper {
  private dynamoDBDocumentClient: DynamoDBDocumentClient;

  constructor(dynamoDBDocumentClient: DynamoDBDocumentClient) {
    this.dynamoDBDocumentClient = dynamoDBDocumentClient;
  }

  async setupTable(): Promise<{ tableName: string }> {
    const tableName = 'dev-User';

    await this.dynamoDBDocumentClient.send(
      new CreateTableCommand({
        TableName: tableName,
        KeySchema: [
          { AttributeName: 'userID', KeyType: 'HASH' },
          { AttributeName: 'ID', KeyType: 'RANGE' },
        ],
        AttributeDefinitions: [
          { AttributeName: 'userID', AttributeType: 'S' },
          { AttributeName: 'ID', AttributeType: 'S' },
          { AttributeName: 'userName', AttributeType: 'S' },
        ],
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
        GlobalSecondaryIndexes: [
          {
            IndexName: 'userNameIndex',
            KeySchema: [{ AttributeName: 'userName', KeyType: 'HASH' }],
            Projection: {
              ProjectionType: 'ALL',
            },
            ProvisionedThroughput: {
              ReadCapacityUnits: 5,
              WriteCapacityUnits: 5,
            },
          },
        ],
      })
    );

    return {
      tableName,
    };
  }
}
