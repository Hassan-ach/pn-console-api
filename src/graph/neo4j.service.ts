import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import neo4j, { Driver, Session } from 'neo4j-driver';
import { Neo4jGraph } from '@langchain/community/graphs/neo4j_graph';

@Injectable()
export class Neo4jService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(Neo4jService.name);
    private driver: Driver | null = null;
    private neo4jGraph: Neo4jGraph | null = null;

    constructor(private readonly configService: ConfigService) {}

    async onModuleInit() {
        const url = this.configService.get<string>('NEO4J_URI', 'bolt://localhost:7687');
        const username = this.configService.get<string>('NEO4J_USER', 'neo4j');
        const password = this.configService.get<string>('NEO4J_PASSWORD', 'pn_console_password');

        try {
            this.driver = neo4j.driver(url, neo4j.auth.basic(username, password));
            await this.driver.verifyConnectivity();
            this.logger.log(`Connected to Neo4j database at ${url}`);

            try {
                this.neo4jGraph = await Neo4jGraph.initialize({
                    url,
                    username,
                    password,
                });
                this.logger.log('Initialized LangChain Neo4jGraph instance');
            } catch (err) {
                this.logger.warn(`Failed to initialize LangChain Neo4jGraph wrapper: ${(err as Error).message}`);
            }
        } catch (error) {
            this.logger.warn(`Could not connect to Neo4j at ${url}: ${(error as Error).message}`);
        }
    }

    async onModuleDestroy() {
        if (this.driver) {
            await this.driver.close();
            this.logger.log('Closed Neo4j driver connection');
        }
    }

    getDriver(): Driver | null {
        return this.driver;
    }

    getGraph(): Neo4jGraph | null {
        return this.neo4jGraph;
    }

    async executeRead<T = any>(cypher: string, params: Record<string, any> = {}): Promise<T[]> {
        if (!this.driver) {
            this.logger.debug('[Neo4j] Driver not connected; skipping read query');
            return [];
        }
        const start = Date.now();
        const session: Session = this.driver.session();
        try {
            this.logger.debug(`[Neo4j Read] Query: ${cypher.trim().replace(/\s+/g, ' ')} | Params: ${JSON.stringify(params)}`);
            const result = await session.executeRead((tx) => tx.run(cypher, params));
            const records = result.records.map((record) => record.toObject() as T);
            this.logger.debug(`[Neo4j Read Success] Returned ${records.length} records in ${Date.now() - start}ms`);
            return records;
        } catch (error) {
            this.logger.error(`[Neo4j Read Error] (${Date.now() - start}ms): ${(error as Error).message}`, (error as Error).stack);
            throw error;
        } finally {
            await session.close();
        }
    }

    async executeWrite<T = any>(cypher: string, params: Record<string, any> = {}): Promise<T[]> {
        if (!this.driver) {
            this.logger.debug('[Neo4j] Driver not connected; skipping write query');
            return [];
        }
        const start = Date.now();
        const session: Session = this.driver.session();
        try {
            this.logger.debug(`[Neo4j Write] Query: ${cypher.trim().replace(/\s+/g, ' ')} | Params: ${JSON.stringify(params)}`);
            const result = await session.executeWrite((tx) => tx.run(cypher, params));
            const records = result.records.map((record) => record.toObject() as T);
            this.logger.debug(`[Neo4j Write Success] Executed in ${Date.now() - start}ms`);
            return records;
        } catch (error) {
            this.logger.error(`[Neo4j Write Error] (${Date.now() - start}ms): ${(error as Error).message}`, (error as Error).stack);
            throw error;
        } finally {
            await session.close();
        }
    }
}
