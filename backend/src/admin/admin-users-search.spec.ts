import { DataSource } from 'typeorm';
import * as entities from '../database/entities';
import { AdminService } from './admin.service';

describe('AdminService user search SQL', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      entities: Object.values(entities).filter((value) => typeof value === 'function'),
    });
    // Build real PostgreSQL query metadata without connecting to a database.
    await (dataSource as any).buildMetadatas();
  });

  it.each([undefined, 'client', 'organizer', 'admin'])(
    'quotes the user alias in name searches with role %s',
    async (role) => {
      const query = dataSource.getRepository(entities.User).createQueryBuilder('user');
      jest.spyOn(query, 'getManyAndCount').mockResolvedValue([[], 0]);
      const userRepo = { createQueryBuilder: jest.fn().mockReturnValue(query) };
      const service = new AdminService(
        userRepo as any, {} as any, {} as any, {} as any, {} as any,
        {} as any, {} as any, {} as any, {} as any,
      );

      await expect(service.getUsers(1, 20, role, '  Ana Perez  ')).resolves.toEqual({
        users: [], total: 0, page: 1, totalPages: 0,
      });

      const [sql, parameters] = query.getQueryAndParameters();
      expect(sql).toContain('"user"."firstName" ILIKE');
      expect(sql).toContain('"user"."lastName" ILIKE');
      expect(sql).toContain(`CONCAT_WS(' ', "user"."firstName", "user"."lastName") ILIKE`);
      expect(sql).toContain('"user"."username" ILIKE');
      expect(sql).toContain('"user"."email" ILIKE');
      expect(sql).not.toMatch(/(?<!["\w])user\./);
      expect(parameters).toContain('%Ana Perez%');
      expect(sql).not.toContain('Ana Perez');
      if (role === 'organizer') expect(sql).toContain('EXISTS');
      else if (role) expect(parameters).toContain(role);
    },
  );
});
