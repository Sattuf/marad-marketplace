import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';

@Injectable()
export class ElasticsearchService implements OnModuleInit {
  public readonly client: Client;
  private readonly logger = new Logger(ElasticsearchService.name);
  private readonly indexName = 'marad_listings';

  constructor() {
    this.client = new Client({
      node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
      maxRetries: 3,
      requestTimeout: 5000,
    });
  }

  /**
   * Elasticsearch can still be starting (or restarting) when this service boots. Creating the
   * index once and giving up let the first indexed document auto-create it with a dynamic
   * mapping (geo_point as numbers, keywords as text), which breaks ranked search for good.
   * So retry with backoff; the deployment also disables auto-creation of this index.
   */
  async onModuleInit(attempts = Number(process.env.ES_INIT_ATTEMPTS ?? 30), delayMs = 2000) {
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        await this.ensureIndex();
        return;
      } catch (error) {
        const last = attempt === attempts;
        this.logger[last ? 'error' : 'warn'](
          `Elasticsearch index not ready (attempt ${attempt}/${attempts}): ${error.message}`,
        );
        if (last) return;
        await new Promise((resolve) => setTimeout(resolve, Math.min(delayMs * attempt, 10_000)));
      }
    }
  }

  private async ensureIndex() {
    {
      const indexExists = await this.client.indices.exists({ index: this.indexName });
      if (!indexExists) {
        await this.client.indices.create({
          index: this.indexName,
          body: {
            settings: {
              analysis: {
                analyzer: {
                  arabic_analyzer: {
                    type: 'custom',
                    tokenizer: 'standard',
                    filter: ['lowercase', 'arabic_normalization', 'arabic_stop', 'arabic_stemmer'],
                  },
                },
                filter: {
                  arabic_stop: {
                    type: 'stop',
                    stopwords: '_arabic_',
                  },
                  arabic_stemmer: {
                    type: 'stemmer',
                    language: 'arabic',
                  },
                },
              },
            },
            mappings: {
              properties: {
                id: { type: 'keyword' },
                title: { 
                  type: 'text',
                  analyzer: 'arabic_analyzer',
                  fields: {
                    keyword: { type: 'keyword' }
                  }
                },
                description: { 
                  type: 'text',
                  analyzer: 'arabic_analyzer'
                },
                price: { type: 'double' },
                location: { type: 'geo_point' },
                category: { type: 'keyword' },
                category_ids: { type: 'keyword' },
                status: { type: 'keyword' },
                tags: { type: 'keyword' },
                createdAt: { type: 'date' },
                updatedAt: { type: 'date' },
                boost_multiplier: { type: 'float' },
                expires_at: { type: 'date' }
              },
            },
          },
        });
        this.logger.log(`Created index ${this.indexName} with mapping`);
      } else {
        // Fields added after the index was first created (adding fields is allowed in place).
        await this.client.indices.putMapping({
          index: this.indexName,
          properties: { category_ids: { type: 'keyword' }, status: { type: 'keyword' } },
        });
        this.logger.log(`Index ${this.indexName} already exists; mapping ensured`);
      }
    }
  }
  async updateDocumentFields(
    id: string,
    fields: Partial<{ images_count: number; description_length: number; seller_average_rating: number }>
  ) {
    try {
      await this.client.update({
        index: this.indexName,
        id,
        body: {
          doc: fields,
        },
      });
      this.logger.log(`Updated fields for document ${id}`);
    } catch (error) {
      this.logger.error(`Failed to update document ${id}: ${error.message}`);
    }
  }
}
