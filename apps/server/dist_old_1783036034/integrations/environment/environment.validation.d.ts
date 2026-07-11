export declare class EnvironmentVariables {
    DATABASE_URL: string;
    REDIS_URL: string;
    APP_URL: string;
    APP_SECRET: string;
    MAIL_DRIVER: string;
    STORAGE_DRIVER: string;
    COLLAB_URL: string;
    CLOUD: boolean;
    SUBDOMAIN_HOST: string;
    SEARCH_DRIVER: string;
    TYPESENSE_URL: string;
    TYPESENSE_API_KEY: string;
    TYPESENSE_LOCALE: string;
    AI_DRIVER: string;
    AI_EMBEDDING_MODEL: string;
    AI_EMBEDDING_DIMENSION: string;
    AI_EMBEDDING_SUPPORTS_MRL: string;
    AI_COMPLETION_MODEL: string;
    OPENAI_API_KEY: string;
    OPENAI_API_URL: string;
    GEMINI_API_KEY: string;
    OLLAMA_API_URL: string;
    EVENT_STORE_DRIVER: string;
    CLICKHOUSE_URL: string;
}
export declare function validate(config: Record<string, any>): EnvironmentVariables;
