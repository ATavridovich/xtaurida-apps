/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Anastasiia Tavridovich. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import type { XtformAST, ASTNode } from '../types/messages';
import * as InputComponents from './inputs';

interface FormViewProps {
	ast: XtformAST | null;
	data: Record<string, any>;
	onDataChange: (fieldName: string, value: any) => void;
}

export function FormView({ ast, data, onDataChange }: FormViewProps) {
	if (!ast) {
		return <div className="form-view">Loading form...</div>;
	}

	return (
		<div className="form-view">
			{ast.metadata.title && <h1>{ast.metadata.title}</h1>}
			{ast.metadata.description && <p className="form-description">{ast.metadata.description}</p>}
			<div className="form-content">
				{renderNode(ast.body, data, onDataChange)}
			</div>
		</div>
	);
}

/**
 * Render an AST node
 */
function renderNode(
	node: ASTNode,
	data: Record<string, any>,
	onDataChange: (fieldName: string, value: any) => void
): React.ReactNode {
	switch (node.type) {
		case 'Document':
			return node.children?.map((child: ASTNode, i: number) => (
				<React.Fragment key={i}>{renderNode(child, data, onDataChange)}</React.Fragment>
			));

		case 'Heading':
			const HeadingTag = `h${node.level}` as keyof JSX.IntrinsicElements;
			return (
				<HeadingTag key={node.line}>
					{node.children?.map((child: ASTNode, i: number) => renderNode(child, data, onDataChange))}
				</HeadingTag>
			);

		case 'Paragraph':
			return (
				<p key={node.line}>
					{node.children?.map((child: ASTNode, i: number) => renderNode(child, data, onDataChange))}
				</p>
			);

		case 'Text':
			return node.value;

		case 'Component':
			return renderComponent(node, data, onDataChange);

		default:
			return null;
	}
}

/**
 * Render a component node
 */
function renderComponent(
	node: ASTNode,
	data: Record<string, any>,
	onDataChange: (fieldName: string, value: any) => void
): React.ReactNode {
	const componentName = node.name;
	const props = node.props || {};

	// Get the component from our input components
	const Component = (InputComponents as any)[componentName];

	if (!Component) {
		return (
			<div key={node.line} className="unknown-component">
				Unknown component: {componentName}
			</div>
		);
	}

	// Get current value from data
	const value = props.name ? data[props.name] : undefined;

	// Create props for the component
	const componentProps = {
		...props,
		value,
		onChange: (newValue: any) => {
			if (props.name) {
				onDataChange(props.name, newValue);
			}
		}
	};

	return <Component key={node.line || Math.random()} {...componentProps} />;
}
