export interface DashboardAccess {
  dashboard: string;
  sections: string[];
}

export default class User {
  public _id?: string;
  public username = '';
  public profileType?: 'ADMIN' | 'INVITADO';
  public access: DashboardAccess[] = [];   // ← inicializo aquí
  public access_token?: string;

  constructor(data: Partial<User>) {
    Object.assign(this, data);
  }
}

export class UserForm extends User {
  public password = '';
  constructor(data: Partial<UserForm>) {
    super(data);
    Object.assign(this, data);
  }
}
