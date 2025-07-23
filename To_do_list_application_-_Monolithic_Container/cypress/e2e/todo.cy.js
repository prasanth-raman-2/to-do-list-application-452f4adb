describe('To-Do List E2E', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000');
  });

  it('adds a new task and displays it', () => {
    cy.get('[data-testid=new-task-input]').type('First Cypress Task');
    cy.get('[data-testid=add-task-btn]').click();
    cy.contains('First Cypress Task').should('exist');
  });

  it('marks a task as complete and incomplete', () => {
    cy.get('[data-testid=new-task-input]').type('Cypress Complete Task');
    cy.get('[data-testid=add-task-btn]').click();
    cy.contains('Cypress Complete Task')
      .parent()
      .parent()
      .within(() => {
        cy.get('[data-testid=toggle-task]').click();
        cy.get('[data-testid=task-completed]').should('exist');
        cy.get('[data-testid=toggle-task]').click();
        cy.get('[data-testid=task-completed]').should('not.exist');
      });
  });

  it('edits a task', () => {
    cy.get('[data-testid=new-task-input]').type('Task To Edit');
    cy.get('[data-testid=add-task-btn]').click();
    cy.contains('Task To Edit').parent().parent().within(() => {
      cy.get('[data-testid=edit-task]').click();
    });
    cy.get('[data-testid=edit-task-input]').clear().type('Task Edited');
    cy.get('[data-testid=save-task-btn]').click();
    cy.contains('Task Edited').should('exist');
  });

  it('deletes a task', () => {
    cy.get('[data-testid=new-task-input]').type('Task To Delete');
    cy.get('[data-testid=add-task-btn]').click();
    cy.contains('Task To Delete').parent().parent().within(() => {
      cy.get('[data-testid=delete-task]').click();
    });
    cy.get('body').should('not.contain.text', 'Task To Delete');
  });

  it('filters to only completed', () => {
    cy.get('[data-testid=new-task-input]').type('Complete Me');
    cy.get('[data-testid=add-task-btn]').click();
    cy.contains('Complete Me').parent().parent().within(() => {
      cy.get('[data-testid=toggle-task]').click();
    });
    cy.get('[data-testid=filter-completed]').click();
    cy.contains('Complete Me').should('exist');
    cy.get('[data-testid=filter-active]').click();
    cy.contains('Complete Me').should('not.exist');
    cy.get('[data-testid=filter-all]').click();
    cy.contains('Complete Me').should('exist');
  });

  it('searches for a task', () => {
    cy.get('[data-testid=new-task-input]').type('Unique Search Task');
    cy.get('[data-testid=add-task-btn]').click();
    cy.get('[data-testid=search-input]').type('Unique Search');
    cy.contains('Unique Search Task').should('exist');
    cy.get('[data-testid=search-input]').clear();
    cy.contains('Unique Search Task').should('exist');
  });

  it('selects multiple tasks and perform bulk complete and delete', () => {
    cy.get('[data-testid=new-task-input]').type('Bulk 1');
    cy.get('[data-testid=add-task-btn]').click();
    cy.get('[data-testid=new-task-input]').type('Bulk 2');
    cy.get('[data-testid=add-task-btn]').click();
    cy.get('input[type=checkbox][data-testid=select-task]').check({ multiple: true });
    cy.get('[data-testid=bulk-complete-btn]').click();
    cy.get('[data-testid=task-completed]').should('have.length.at.least', 2);
    cy.get('input[type=checkbox][data-testid=select-task]').check({ multiple: true });
    cy.get('[data-testid=bulk-delete-btn]').click();
    cy.contains('Bulk 1').should('not.exist');
    cy.contains('Bulk 2').should('not.exist');
  });
});
