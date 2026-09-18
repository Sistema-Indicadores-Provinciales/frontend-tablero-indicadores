import Sections from './Sections';

class Dashboard {
  public _id?: string;
  public keyname: string = '';
  public name?: string;
  public show: boolean = false;
  public sections: Sections[] = [];
  public icon?: string;
  public generatedWorkspaceId?: string;
  
  constructor(data: Partial<Dashboard>) {
    Object.assign(this, data);
  }
}

export class DashboardForm extends Dashboard {
  public newKeyname?: string;
  public newName?: string;

  constructor(data: Partial<DashboardForm>) {
    super(data);
    Object.assign(this, data);
  }
}

export default Dashboard;
